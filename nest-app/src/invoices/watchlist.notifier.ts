import { Injectable, Logger } from '@nestjs/common';

// STUB: tells the nodes-events scanner to stop watching an address.
// Replace the body with the real HTTP call to nodes-events in INV-5.
@Injectable()
export class WatchlistNotifier {
  private readonly logger = new Logger(WatchlistNotifier.name);

  remove(address: string): Promise<void> {
    this.logger.log(
      `STUB: would remove ${address} from nodes-events watchlist`,
    );
    return Promise.resolve();
  }
}
