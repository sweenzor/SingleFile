pub mod types;
pub mod util;

use types::{MhtmlResource, ParseResult};
use util::*;

const CONTENT_TYPE_HEADER: &str = "content-type";
const CONTENT_TRANSFER_ENCODING_HEADER: &str = "content-transfer-encoding";
const CONTENT_ID_HEADER: &str = "content-id";
const CONTENT_LOCATION_HEADER: &str = "content-location";
const QUOTED_PRINTABLE_ENCODING: &str = "quoted-printable";
const BASE64_ENCODING: &str = "base64";
const BINARY_ENCODING: &str = "binary";

#[derive(PartialEq, Clone, Copy)]
enum State {
    MhtmlHeaders,
    MhtmlContent,
    MhtmlData,
    MhtmlEnd,
}

/// Parse MHTML bytes into structured data.
/// This is the Rust port of parse.js lines 46-208.
pub fn parse(mhtml: &[u8], result: &mut ParseResult) {
    let mut state = State::MhtmlHeaders;
    let mut index: usize = 0;
    let mut header_key = String::new();
    let mut transfer_encoding: Option<String> = None;
    let mut boundary: Option<Vec<u8>> = None;
    let mut content = std::collections::HashMap::<String, String>::new();
    let mut resource: Option<MhtmlResource> = None;
    let mut index_start_embedded: Option<usize> = None;

    while state != State::MhtmlEnd && index < mhtml.len().saturating_sub(1) {
        if state == State::MhtmlHeaders {
            let next = get_line(mhtml, &mut index, None);
            if is_line_feed(&next) {
                if let Some(ct) = result.headers.get(CONTENT_TYPE_HEADER) {
                    if let Some(b) = get_boundary(ct) {
                        boundary = Some(b.into_bytes());
                    }
                }
                if let Some(ref boundary_bytes) = boundary {
                    let mut next = next;
                    while index_of(&next, boundary_bytes) == -1
                        && index < mhtml.len().saturating_sub(1)
                    {
                        next = get_line(mhtml, &mut index, None);
                    }
                } else {
                    let prev_index = index;
                    let next = get_line(mhtml, &mut index, transfer_encoding.as_deref());
                    if boundary.is_none() && starts_with_boundary(&next) {
                        boundary = Some(decode_string(&next).trim().as_bytes().to_vec());
                    } else {
                        index = prev_index;
                    }
                }
                content.clear();
                state = State::MhtmlContent;
            } else {
                split_headers(&next, &mut result.headers, &mut header_key);
            }
        } else if state == State::MhtmlContent {
            if boundary.is_some() {
                if index_start_embedded.is_none() {
                    index_start_embedded = Some(index);
                }
                let next = get_line(mhtml, &mut index, None);
                if is_line_feed(&next) {
                    let (res, te) = init_resource(&content, result);
                    transfer_encoding = te;
                    if res.content_type.is_none()
                        || !is_multipart_alternative(
                            res.content_type.as_deref().unwrap_or(""),
                        )
                    {
                        index_start_embedded = None;
                    }
                    resource = Some(res);
                    state = State::MhtmlData;
                } else {
                    split_headers(&next, &mut content, &mut header_key);
                }
            } else {
                // Extract needed header values before borrowing result mutably
                let headers_snapshot = extract_resource_headers(&result.headers);
                let (res, te) = init_resource_from_values(headers_snapshot, result);
                transfer_encoding = te;
                resource = Some(res);
                state = State::MhtmlData;
            }
        } else if state == State::MhtmlData {
            let res = resource.as_mut().unwrap();
            let index_end_data = parse_resource_data(
                mhtml,
                &mut index,
                res,
                boundary.as_deref(),
                transfer_encoding.as_deref(),
            );

            if let (Some(start), Some(end)) = (index_start_embedded, index_end_data) {
                let mut res = resource.take().unwrap();
                res.used = true;
                // Store the resource, then handle embedded MHTML
                store_resource(res, &content, result);
                // Parse embedded MHTML
                let mut end_adj = end;
                if ends_with_crlf(mhtml) {
                    end_adj = end.saturating_sub(2);
                } else if ends_with_lf(mhtml) {
                    end_adj = end.saturating_sub(1);
                }
                if start < end_adj && end_adj <= mhtml.len() {
                    parse(&mhtml[start..end_adj], result);
                }
            } else {
                let mut res = resource.take().unwrap();
                process_resource(&mut res);
                store_resource(res, &content, result);
            }

            content.clear();
            resource = None;
            state = if index >= mhtml.len().saturating_sub(1) {
                State::MhtmlEnd
            } else {
                State::MhtmlContent
            };
        }
    }
}

/// Store a resource into result.resources and result.frames.
fn store_resource(
    res: MhtmlResource,
    content: &std::collections::HashMap<String, String>,
    result: &mut ParseResult,
) {
    if let Some(content_id) = content.get(CONTENT_ID_HEADER) {
        result.frames.insert(content_id.clone(), res.clone());
    }
    if !result.resources.contains_key(&res.id) {
        result.resources.insert(res.id.clone(), res);
    }
}

fn get_line(mhtml: &[u8], index: &mut usize, transfer_encoding: Option<&str>) -> Vec<u8> {
    let start = *index;
    while *index < mhtml.len() {
        if mhtml[*index] == 0x0A {
            *index += 1;
            break;
        }
        *index += 1;
    }
    let line = mhtml[start..*index].to_vec();
    if transfer_encoding == Some(QUOTED_PRINTABLE_ENCODING) {
        decode_quoted_printable(&line)
    } else {
        line
    }
}

fn split_headers(
    line: &[u8],
    obj: &mut std::collections::HashMap<String, String>,
    header_key: &mut String,
) {
    let line_str = decode_string(line);
    if let Some(colon_pos) = line_str.find(':') {
        *header_key = line_str[..colon_pos].trim().to_lowercase();
        let value = line_str[colon_pos + 1..].trim().to_string();
        obj.insert(header_key.clone(), value);
    } else {
        // Continuation line — append to the last header
        if let Some(existing) = obj.get_mut(header_key) {
            existing.push_str(line_str.trim());
        }
    }
}

/// Extracted header values needed by init_resource, to avoid cloning the whole HashMap.
struct ResourceHeaders {
    transfer_encoding: Option<String>,
    content_type: Option<String>,
    content_id: Option<String>,
    content_location: Option<String>,
}

fn extract_resource_headers(headers: &std::collections::HashMap<String, String>) -> ResourceHeaders {
    ResourceHeaders {
        transfer_encoding: headers.get(CONTENT_TRANSFER_ENCODING_HEADER).cloned(),
        content_type: headers.get(CONTENT_TYPE_HEADER).cloned(),
        content_id: headers.get(CONTENT_ID_HEADER).cloned(),
        content_location: headers.get(CONTENT_LOCATION_HEADER).cloned(),
    }
}

fn init_resource(
    headers: &std::collections::HashMap<String, String>,
    result: &mut ParseResult,
) -> (MhtmlResource, Option<String>) {
    init_resource_from_values(extract_resource_headers(headers), result)
}

fn init_resource_from_values(
    headers: ResourceHeaders,
    result: &mut ParseResult,
) -> (MhtmlResource, Option<String>) {
    let transfer_encoding = headers.transfer_encoding.map(|s| s.to_lowercase());

    let id = if let Some(loc) = headers.content_location {
        loc
    } else if let Some(ref cid) = headers.content_id {
        cid.clone()
    } else {
        let mut id;
        loop {
            id = format!("_{:x}", js_random_u64());
            if !result.resources.contains_key(&id) {
                break;
            }
        }
        id
    };

    if result.index.is_none() {
        if let Some(ref ct) = headers.content_type {
            if is_document(ct) {
                result.index = Some(id.clone());
            }
        }
    }

    let resource = MhtmlResource {
        id,
        content_type: headers.content_type,
        transfer_encoding: transfer_encoding.clone(),
        data: Vec::new(),
        used: false,
    };

    (resource, transfer_encoding)
}

/// Generate a random u64 using the JS Math.random() API.
fn js_random_u64() -> u64 {
    (js_sys::Math::random() * u64::MAX as f64) as u64
}

fn parse_resource_data(
    mhtml: &[u8],
    index: &mut usize,
    resource: &mut MhtmlResource,
    boundary: Option<&[u8]>,
    transfer_encoding: Option<&str>,
) -> Option<usize> {
    let mut next = get_line(mhtml, index, transfer_encoding);
    let mut index_end_data: Option<usize> = None;
    let mut boundary_found = false;

    while !boundary_found && *index < mhtml.len().saturating_sub(1) {
        index_end_data = Some(*index);

        if let Some(boundary_bytes) = boundary {
            let idx = index_of(&next, boundary_bytes);
            if idx != -1 {
                let idx = idx as usize;
                let end = index_end_data.unwrap();
                index_end_data = Some(end - next.len() + idx - 2);
                if idx > 2 {
                    next = next[..idx - 2].to_vec();
                } else {
                    next = Vec::new();
                }
                boundary_found = true;
            }
        }

        if transfer_encoding == Some(QUOTED_PRINTABLE_ENCODING) {
            let data_len = resource.data.len();
            if data_len > 2
                && resource.data[data_len - 3] == 0x3D
                && ends_with_crlf(&next)
            {
                resource.data.truncate(data_len - 3);
            } else if data_len > 1
                && resource.data[data_len - 2] == 0x3D
                && ends_with_lf(&next)
            {
                resource.data.truncate(data_len - 2);
            }
        } else if transfer_encoding == Some(BASE64_ENCODING) {
            if ends_with_crlf(&next) {
                next.truncate(next.len() - 2);
            } else if ends_with_lf(&next) {
                next.truncate(next.len() - 1);
            }
        }

        resource.data.extend_from_slice(&next);

        if !boundary_found {
            next = get_line(mhtml, index, transfer_encoding);
        }
    }

    if !boundary_found && boundary.is_some() {
        index_end_data = Some(*index);
    }

    index_end_data
}

/// Process resource data: apply transfer encoding transformations.
/// Note: charset decoding and DOM-dependent processing (processStylesheetCharset,
/// processDocumentCharset) are handled in the JS wrapper.
fn process_resource(resource: &mut MhtmlResource) {
    if resource.transfer_encoding.as_deref() == Some(BINARY_ENCODING) {
        let is_text = resource
            .content_type
            .as_deref()
            .map(|ct| is_text(ct))
            .unwrap_or(true);
        if !is_text {
            resource.transfer_encoding = Some(BASE64_ENCODING.to_string());
            let encoded = decode_binary(&resource.data);
            resource.data = encoded.into_bytes();
        }
    }
}
