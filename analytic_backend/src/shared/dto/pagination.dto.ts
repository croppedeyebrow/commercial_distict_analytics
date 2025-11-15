// import { Transform, TransformFnParams } from 'class-transformer';
// import { IsInt, IsOptional, Max, Min } from 'class-validator';

// const parsePaginationValue = (input: unknown): number | undefined => {
//   if (input === undefined || input === null || input === '') {
//     return undefined;
//   }

//   if (typeof input === 'number') {
//     return Number.isNaN(input) ? undefined : input;
//   }

//   if (typeof input === 'string') {
//     const parsed = Number.parseInt(input, 10);
//     return Number.isNaN(parsed) ? undefined : parsed;
//   }

//   return undefined;
// };

// export class PaginationQueryDto {
//   @IsOptional()
//   @Transform(({ value }: TransformFnParams) => parsePaginationValue(value))
//   @IsInt()
//   @Min(1)
//   page = 1;

//   @IsOptional()
//   @Transform(({ value }: TransformFnParams) => parsePaginationValue(value))
//   @IsInt()
//   @Min(1)
//   @Max(100)
//   limit = 20;
// }
