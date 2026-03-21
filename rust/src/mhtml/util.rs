use memchr::memmem;

/// Decode quoted-printable encoded bytes.
/// =XX sequences where XX are hex digits are decoded to the byte value.
pub fn decode_quoted_printable(array: &[u8]) -> Vec<u8> {
    let mut result = Vec::with_capacity(array.len());
    let mut i = 0;
    while i < array.len() {
        if array[i] == 0x3D && i + 2 < array.len() && is_hex(array[i + 1]) && is_hex(array[i + 2]) {
            let high = hex_val(array[i + 1]);
            let low = hex_val(array[i + 2]);
            result.push((high << 4) | low);
            i += 3;
        } else {
            result.push(array[i]);
            i += 1;
        }
    }
    result
}

fn is_hex(b: u8) -> bool {
    (b >= 0x30 && b <= 0x39) || (b >= 0x41 && b <= 0x46)
}

fn hex_val(b: u8) -> u8 {
    if b >= 0x30 && b <= 0x39 {
        b - 0x30
    } else {
        b - 0x41 + 10
    }
}

/// Convert binary data to base64 string.
pub fn decode_binary(array: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::with_capacity((array.len() + 2) / 3 * 4);
    let chunks = array.chunks(3);
    for chunk in chunks {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        result.push(CHARS[((triple >> 18) & 0x3F) as usize] as char);
        result.push(CHARS[((triple >> 12) & 0x3F) as usize] as char);
        if chunk.len() > 1 {
            result.push(CHARS[((triple >> 6) & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
        if chunk.len() > 2 {
            result.push(CHARS[(triple & 0x3F) as usize] as char);
        } else {
            result.push('=');
        }
    }
    result
}

/// Find the index of a string (as bytes) within a byte array.
/// Uses memchr's optimized SIMD search.
pub fn index_of(array: &[u8], needle: &[u8]) -> isize {
    match memmem::find(array, needle) {
        Some(pos) => pos as isize,
        None => -1,
    }
}

/// Extract boundary parameter from Content-Type header value.
pub fn get_boundary(content_type: &str) -> Option<String> {
    let parts: Vec<&str> = content_type.split(';').collect();
    for part in parts.iter().skip(1) {
        let trimmed = part.trim();
        if trimmed.starts_with("boundary=") {
            let value = &trimmed[9..];
            return Some(remove_quotes(value));
        }
    }
    None
}

fn remove_quotes(value: &str) -> String {
    let trimmed = value.trim();
    if (trimmed.starts_with('"') && trimmed.ends_with('"'))
        || (trimmed.starts_with('\'') && trimmed.ends_with('\''))
    {
        trimmed[1..trimmed.len() - 1].to_string()
    } else {
        trimmed.to_string()
    }
}

/// Check if array is just a line feed (LF or CRLF).
pub fn is_line_feed(array: &[u8]) -> bool {
    match array.len() {
        2 => array[0] == 0x0D && array[1] == 0x0A,
        1 => array[0] == 0x0A,
        _ => false,
    }
}

/// Check if array ends with CRLF.
pub fn ends_with_crlf(array: &[u8]) -> bool {
    if array.len() >= 2 {
        array[array.len() - 2] == 0x0D && array[array.len() - 1] == 0x0A
    } else if array.len() >= 1 {
        array[array.len() - 1] == 0x0D
    } else {
        false
    }
}

/// Check if array ends with LF.
pub fn ends_with_lf(array: &[u8]) -> bool {
    array.last() == Some(&0x0A)
}

/// Check if array starts with "--" (boundary prefix).
pub fn starts_with_boundary(array: &[u8]) -> bool {
    array.len() >= 2 && array[0] == 0x2D && array[1] == 0x2D
}

/// Extract charset from Content-Type header.
pub fn get_charset(content_type: &str) -> Option<String> {
    let lower = content_type.to_lowercase();
    if let Some(pos) = lower.find("charset=") {
        let rest = &content_type[pos + 8..];
        let end = rest.find(';').unwrap_or(rest.len());
        let value = &rest[..end];
        Some(remove_quotes(value).to_lowercase())
    } else {
        None
    }
}

/// Replace charset in Content-Type header.
pub fn replace_charset(content_type: &str, charset: &str) -> String {
    if let Some(start) = content_type.to_lowercase().find("charset=") {
        let rest = &content_type[start + 8..];
        let end = rest.find(';').unwrap_or(rest.len());
        format!(
            "{}charset={}{}",
            &content_type[..start],
            charset,
            &rest[end..]
        )
    } else {
        content_type.to_string()
    }
}

/// Check if content type is a document (text/html or application/xhtml+xml).
pub fn is_document(content_type: &str) -> bool {
    content_type.starts_with("text/html") || content_type.starts_with("application/xhtml+xml")
}

/// Check if content type is a stylesheet.
pub fn is_stylesheet(content_type: &str) -> bool {
    content_type.starts_with("text/css")
}

/// Check if content type is text.
pub fn is_text(content_type: &str) -> bool {
    content_type.starts_with("text/")
}

/// Check if content type is multipart/alternative.
pub fn is_multipart_alternative(content_type: &str) -> bool {
    content_type.starts_with("multipart/alternative")
}

/// Decode a byte slice as UTF-8 string (lossy).
pub fn decode_string(array: &[u8]) -> String {
    String::from_utf8_lossy(array).into_owned()
}
