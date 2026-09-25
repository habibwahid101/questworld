function errorName(error: unknown): string {
  if (typeof error === "object" && error !== null && "name" in error) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === "string") {
      return name;
    }
  }
  return "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "";
}

function isNetwork(error: unknown): boolean {
  return /network|failed to fetch|fetch failed|timeout/i.test(errorMessage(error));
}

export function mapAuthError(error: unknown): string {
  const name = errorName(error);

  switch (name) {
    case "NotAuthorizedException":
    case "UserNotFoundException":
      return "Email or password is incorrect.";
    case "UsernameExistsException":
      return "An account with this email already exists. Try logging in.";
    case "InvalidPasswordException":
      return "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.";
    case "InvalidParameterException":
      return "Check the information you entered and try again.";
    case "CodeMismatchException":
      return "That reset code is not valid. Request a new code and try again.";
    case "ExpiredCodeException":
      return "That reset code has expired. Request a new code.";
    case "LimitExceededException":
    case "TooManyRequestsException":
    case "TooManyFailedAttemptsException":
      return "Too many attempts. Wait a moment and try again.";
    case "ConfigError":
      return "Authentication is not configured yet.";
    case "SignupConfirmationError":
      return "Your account could not be confirmed automatically. This product does not use a signup verification code. Try again once authentication deployment is complete.";
    default:
      if (isNetwork(error)) {
        return "We could not reach the authentication service. Check your connection and try again.";
      }
      return "Something went wrong. Please try again.";
  }
}

/** Neutral on purpose so password recovery does not reveal whether an email exists. */
export function mapRecoveryRequestError(error: unknown): string | null {
  const name = errorName(error);

  if (
    name === "UserNotFoundException" ||
    name === "NotAuthorizedException" ||
    name === "InvalidParameterException" ||
    name === "CodeDeliveryFailureException"
  ) {
    return null;
  }

  if (
    name === "LimitExceededException" ||
    name === "TooManyRequestsException" ||
    name === "TooManyFailedAttemptsException"
  ) {
    return "Too many attempts. Wait a moment and try again.";
  }

  if (name === "ConfigError") {
    return "Authentication is not configured yet.";
  }

  if (isNetwork(error) || name === "InternalErrorException" || name === "UnexpectedLambdaException") {
    return "We could not reach the authentication service. Check your connection and try again.";
  }

  return null;
}
