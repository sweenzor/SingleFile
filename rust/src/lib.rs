mod mhtml;

use mhtml::types::{MhtmlResource, ParseResult};
use wasm_bindgen::prelude::*;

/// Parse MHTML bytes and return structured data.
///
/// Input: Uint8Array (MHTML file contents)
/// Output: JsValue containing { headers, resources, frames, index }
///
/// Resource data is returned as raw bytes — the JS wrapper handles:
/// - charset decoding (TextDecoder with charset param)
/// - processStylesheetCharset (needs cssTree)
/// - processDocumentCharset (needs DOMParser)
/// - convertEmbeddedMhtml recursion (calls back into this function)
#[wasm_bindgen]
pub fn parse_mhtml(mhtml_bytes: &[u8]) -> Result<JsValue, JsValue> {
    let mut result = ParseResult::new();
    mhtml::parse(mhtml_bytes, &mut result);

    let js_obj = js_sys::Object::new();

    // Headers
    let headers = serde_wasm_bindgen::to_value(&result.headers)
        .map_err(|e| JsValue::from_str(&format!("Failed to serialize headers: {}", e)))?;
    js_sys::Reflect::set(&js_obj, &JsValue::from_str("headers"), &headers)?;

    // Index
    let index = match &result.index {
        Some(idx) => JsValue::from_str(idx),
        None => JsValue::UNDEFINED,
    };
    js_sys::Reflect::set(&js_obj, &JsValue::from_str("index"), &index)?;

    // Resources
    let resources_obj = js_sys::Object::new();
    for (key, resource) in &result.resources {
        let res_obj = resource_to_js(resource)?;
        js_sys::Reflect::set(&resources_obj, &JsValue::from_str(key), &res_obj)?;
    }
    js_sys::Reflect::set(&js_obj, &JsValue::from_str("resources"), &resources_obj)?;

    // Frames
    let frames_obj = js_sys::Object::new();
    for (key, resource) in &result.frames {
        let res_obj = resource_to_js(resource)?;
        js_sys::Reflect::set(&frames_obj, &JsValue::from_str(key), &res_obj)?;
    }
    js_sys::Reflect::set(&js_obj, &JsValue::from_str("frames"), &frames_obj)?;

    Ok(js_obj.into())
}

fn resource_to_js(resource: &MhtmlResource) -> Result<JsValue, JsValue> {
    let obj = js_sys::Object::new();
    js_sys::Reflect::set(&obj, &JsValue::from_str("id"), &JsValue::from_str(&resource.id))?;
    if let Some(ref ct) = resource.content_type {
        js_sys::Reflect::set(&obj, &JsValue::from_str("contentType"), &JsValue::from_str(ct))?;
    }
    if let Some(ref te) = resource.transfer_encoding {
        js_sys::Reflect::set(&obj, &JsValue::from_str("transferEncoding"), &JsValue::from_str(te))?;
    }
    let data = js_sys::Uint8Array::from(resource.data.as_slice());
    js_sys::Reflect::set(&obj, &JsValue::from_str("data"), &data)?;
    js_sys::Reflect::set(&obj, &JsValue::from_str("used"), &JsValue::from_bool(resource.used))?;
    Ok(obj.into())
}
