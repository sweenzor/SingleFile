FROM rust:slim

RUN rustup target add wasm32-unknown-unknown \
    && cargo install wasm-pack --locked

WORKDIR /build

COPY Cargo.toml Cargo.toml
COPY src/ src/

RUN wasm-pack build --target web --out-dir /out

FROM scratch
COPY --from=0 /out /out
