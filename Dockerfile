
FROM node:20-alpine As development

WORKDIR /usr/src/app

RUN npm install -g pnpm

COPY package*.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

RUN pnpm run build

FROM node:20-alpine As production

WORKDIR /usr/src/app

RUN npm install -g pnpm

COPY package*.json pnpm-lock.yaml ./

RUN pnpm install --prod

COPY --from=development /usr/src/app/dist ./dist

EXPOSE 3000

CMD [ "node", "dist/main.js" ] 