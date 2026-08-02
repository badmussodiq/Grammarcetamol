import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
  }));

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 8082;
  await app.listen(port);
  console.log(`user-service running on port ${port}`);
}

bootstrap();
