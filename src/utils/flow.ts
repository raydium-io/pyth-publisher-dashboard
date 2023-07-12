type AnyFunction = (parentResult?: any) => any | Promise<any>;

interface Flow {
  func: AnyFunction;
  logPrefix?: string;
}
type Flows = Flow[];

type NextCallBack = (result: any, index: number) => void;
type ErrorCallBack = (error: any, title?: string) => void;
type CompleteCallBack = () => void;

export default class WorkFlow {
  flows: Flows = [];

  nextCallback: NextCallBack;
  errorCallback: ErrorCallBack;
  completeCallback: CompleteCallBack;

  isStopped: boolean;

  constructor() {
    this.nextCallback = () => {};
    this.errorCallback = () => {};
    this.completeCallback = () => {};

    this.isStopped = false;
  }

  static create() {
    return new WorkFlow();
  }

  add(func: AnyFunction, logPrefix?: string) {
    this.flows.push({ func, logPrefix });
  }

  async execute({
    next,
    error,
    complete,
  }: {
    next?: NextCallBack;
    error?: ErrorCallBack;
    complete?: CompleteCallBack;
  }) {
    if (next) this.nextCallback = next;
    if (error) this.errorCallback = error;
    if (complete) this.completeCallback = complete;

    let result;

    for (const [index, { func, logPrefix }] of this.flows.entries()) {
      if (this.isStopped) break;

      try {
        result = await func(result);
        this.next(result, index);
      } catch (error: any) {
        this.error(error.message || error, logPrefix ? `${logPrefix} failed` : "");
      }
    }

    this.complete();
  }

  next(result: any, index: number) {
    if (!this.isStopped) {
      this.nextCallback(result, index);
    }
  }

  error(error: any, title?: string) {
    if (!this.isStopped) {
      this.isStopped = true;
      this.errorCallback(error, title);
    }
  }

  complete() {
    if (!this.isStopped) {
      this.isStopped = true;
      this.completeCallback();
    }
  }
}
