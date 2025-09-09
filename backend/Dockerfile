FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm config set registry https://registry.npmjs.org/
RUN npm cache clean --force
RUN npm install --verbose
COPY . .
EXPOSE 3001
CMD ["npm", "start"]