export class NexonApiError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NexonApiError'
  }
}

export class NexonAuthError extends NexonApiError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NexonAuthError'
  }
}

export class NexonRateLimitError extends NexonApiError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NexonRateLimitError'
  }
}

export class NexonNetworkError extends NexonApiError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NexonNetworkError'
  }
}
