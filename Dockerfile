FROM node:current-alpine

WORKDIR /usr/src/selenology

COPY ["package.json", "package-lock.json*", "./"]
RUN npm install
COPY . .

RUN apt install git=1:2.20.1-2+deb10u3

RUN mkdir -p /usr/bin/selene
RUN mkdir -p /usr/local/repos

RUN chmod +x /usr/src/selonology/entrypoint.sh
ENTRYPOINT [ "/usr/src/selonology/entrypoint.sh" ]
