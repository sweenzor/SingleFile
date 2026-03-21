FROM rust:slim

RUN rustup target add wasm32-unknown-unknown \
    && cargo install wasm-pack --locked

RUN apt-get update && apt-get install -y binaryen && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY Cargo.toml Cargo.toml
COPY src/ src/

RUN wasm-pack build --release --target web --out-dir /out

RUN wasm-opt -Oz -o /out/mhtml_parser_bg.wasm /out/mhtml_parser_bg.wasm

FROM scratch
COPY --from=0 /out /out
