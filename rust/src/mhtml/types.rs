use serde::Serialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize)]
pub struct MhtmlResource {
    pub id: String,
    #[serde(rename = "contentType")]
    pub content_type: Option<String>,
    #[serde(rename = "transferEncoding")]
    pub transfer_encoding: Option<String>,
    pub data: Vec<u8>,
    #[serde(skip)]
    pub used: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ParseResult {
    pub headers: HashMap<String, String>,
    pub resources: HashMap<String, MhtmlResource>,
    pub frames: HashMap<String, MhtmlResource>,
    pub index: Option<String>,
}

impl ParseResult {
    pub fn new() -> Self {
        Self {
            headers: HashMap::new(),
            resources: HashMap::new(),
            frames: HashMap::new(),
            index: None,
        }
    }
}
