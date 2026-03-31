import { Data } from "effect";

export class UnauthorizedError extends Data.TaggedError("UnauthorizedError")<{
  readonly service: string;
  readonly reason: string;
}> {
  override get message() {
    return `${this.service}: ${this.reason}`;
  }
}
