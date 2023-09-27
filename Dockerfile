FROM node:18-slim
WORKDIR /usr/src/app
COPY . .
RUN npm install
RUN npm run build
CMD [ "npm", "start" ]
