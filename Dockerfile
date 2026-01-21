# Stackstarter Dockerfile
# Container for running tests

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . ./

CMD ["npm", "test"]