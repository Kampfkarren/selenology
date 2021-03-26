FROM rust:buster

WORKDIR /usr/src/selenology

# I only barely get why I need to do this, something about Cargo reinstalling dependencies
# every time the src/ changes in Docker because it doesn't support a dependencies only
# configuration.
COPY Cargo.toml Cargo.toml
COPY Cargo.lock Cargo.lock
RUN mkdir src/
RUN echo "fn main() { eprintln!(\"You shouldn't be able to see this!\"); }" > src/main.rs
RUN cargo build --release
RUN rm -f target/release/deps/selenology*
COPY . .
RUN cargo build --release
RUN cargo install --path .

RUN apt install git=1:2.20.1-2+deb10u3

RUN mkdir -p /usr/bin/selene
RUN mkdir -p /usr/local/repos

RUN chmod +x /usr/src/selenology/entrypoint.sh
ENTRYPOINT [ "/usr/src/selenology/entrypoint.sh" ]
