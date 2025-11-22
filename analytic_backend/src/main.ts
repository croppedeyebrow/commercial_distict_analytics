import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './shared/interceptors/logging.interceptor';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

/**
 * NestJS 애플리케이션 시작점
 *
 * 전역 설정을 적용하고 서버를 시작합니다.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 전역 ValidationPipe 설정
  // DTO의 @Transform, @IsInt 등의 데코레이터가 작동하도록 합니다.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // 쿼리 파라미터를 DTO로 자동 변환
      whitelist: true, // DTO에 정의되지 않은 속성 제거
      forbidNonWhitelisted: true, // 정의되지 않은 속성이 있으면 에러 반환
    }),
  );

  // 전역 예외 필터 적용
  app.useGlobalFilters(new HttpExceptionFilter());

  // 전역 로깅 인터셉터 적용
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger API 문서 설정
  const config = new DocumentBuilder()
    .setTitle('상권 분석 API')
    .setDescription('PostGIS 기반 상권 분석 및 시계열 분석 API 문서')
    .setVersion('1.0')
    .addTag('stores', '점포 데이터 조회')
    .addTag('analysis', '상권 분석 지표')
    .addTag('spatial', '공간 분석')
    .addTag('test', '시스템 테스트')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 서버가 ${port} 포트에서 실행 중입니다.`);
  console.log(`📚 Swagger API 문서: http://localhost:${port}/api`);
}
bootstrap();
