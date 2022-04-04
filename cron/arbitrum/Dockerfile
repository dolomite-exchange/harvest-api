FROM node:12.20.1-alpine

RUN apk update &&  \
    apk upgrade && \
    apk -Uuv add --no-cache make g++ git python py-pip jq openssh curl openssh docker &&  \
    pip install --upgrade pip awscli

RUN adduser -S farmer_chad
RUN mkdir -p /home/harvest-finance/app
RUN chown farmer_chad -R /home/harvest-finance/app

WORKDIR /home/harvest-finance/app

COPY ./package.json ./yarn.lock ./
COPY ./.eslintrc.json ./
COPY ./hardhat.config.ts ./
COPY ./next-vault.json ./
COPY ./vault-decision.json ./
COPY ./tsconfig.json ./
COPY ./abi ./abi
COPY ./scripts ./scripts
COPY ./data ./data

RUN chown farmer_chad -R /home/harvest-finance/app

USER farmer_chad

RUN yarn install --immutable --immutable-cache --check-cache

CMD ["npm", "start"]
