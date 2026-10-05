// Only caller-safe messages and field errors belong in this public transport contract.
export class IdentityError extends Error {
  readonly fields?: Readonly<Record<string, readonly string[]>>;
  readonly code = "identity_error";

  constructor(
    public readonly status: number,
    message: string,
    fields?: Record<string, string[]>
  ) {
    if (!Number.isInteger(status) || status < 400 || status > 599)
      throw new Error("Identity errors require an HTTP error status.");
    super(message);
    this.name = "IdentityError";
    if (fields)
      this.fields = Object.freeze(
        Object.fromEntries(
          Object.entries(fields).map(([key, messages]) => [key, Object.freeze([...messages])])
        )
      );
  }
}
