FROM node:current-alpine

WORKDIR /usr/src/selenology

COPY ["package.json", "package-lock.json*", "./"]
RUN npm install
COPY . .

RUN apk add --no-cache git

RUN mkdir -p /usr/bin/selene
RUN mkdir -p /usr/local/repos

RUN chmod +x /usr/src/selonology/entrypoint.sh
ENTRYPOINT [ "/usr/src/selonology/entrypoint.sh" ]
