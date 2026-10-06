import { SquareClient, SquareEnvironment, SquareError } from "square";

export const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  environment:
    process.env.SQUARE_ENVIRONMENT === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
});

export function squareErrorDetail(err: unknown): unknown {
  if (err instanceof SquareError) {
    return { statusCode: err.statusCode, errors: err.errors };
  }
  return err;
}
