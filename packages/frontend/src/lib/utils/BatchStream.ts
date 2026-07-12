export default class BatchStream<T> extends TransformStream<T, T[]> {
  private buffer: T[] = [];
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly interval: number = 500) {
    super({
      transform: (chunk, controller) => {
        this.buffer.push(chunk);

        this.timer ??= setTimeout(() => {
          this.flush(controller);
          this.timer = null;
        }, this.interval);
      },
      flush: (controller) => {
        if (this.timer) clearTimeout(this.timer);
        this.flush(controller);
      },
    });
  }

  private flush(controller: TransformStreamDefaultController<T[]>) {
    if (this.buffer.length > 0) {
      controller.enqueue(this.buffer);
      this.buffer = [];
    }
  }
}
