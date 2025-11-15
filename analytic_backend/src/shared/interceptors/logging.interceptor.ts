import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest<Request>();
    const path = request?.url ?? context.getClass().name;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        console.log(`[${path}] completed in ${duration}ms`);
      }),
    );
  }
}
