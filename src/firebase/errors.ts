export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

/**
 * A custom error class for Firestore permission errors.
 * This class captures the context of the Firestore operation that failed,
 * making it easier to debug security rule violations.
 */
export class FirestorePermissionError extends Error {
  public readonly context: SecurityRuleContext;
  
  constructor(context: SecurityRuleContext) {
    const message = `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:
${JSON.stringify({
  context: {
    operation: context.operation,
    path: context.path,
    requestResource: context.requestResourceData ? { data: context.requestResourceData } : undefined
  }
}, null, 2)}
`;
    super(message);
    this.name = 'FirestorePermissionError';
    this.context = context;
    
    // This is necessary for custom errors to work correctly in TypeScript.
    Object.setPrototypeOf(this, FirestorePermissionError.prototype);
  }

  toString() {
    return this.message;
  }
}
