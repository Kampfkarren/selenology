FROM rust:1-alpine

WORKDIR /usr/src/selenology

RUN apk add git nodejs npm

COPY ["package.json", "package-lock.json*", "./"]
RUN npm install
COPY . .

RUN mkdir -p /usr/bin/selene
RUN mkdir -p /usr/local/repos

RUN chmod +x /usr/src/selenology/entrypoint.sh
ENTRYPOINT [ "/usr/src/selenology/entrypoint.sh" ]
