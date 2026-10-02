declare module "bittorrent-tracker" {
  interface ScrapeOptions {
    announce: string;
    infoHash: Buffer[];
  }

  export interface ScrapeResult {
    announce: string;
    infoHash: string;
    complete: number;
    incomplete: number;
    downloaded: number;
  }

  export type ScrapeResponse = ScrapeResult | Record<string, ScrapeResult>;

  interface ScrapeClient {
    destroy(): void;
  }

  interface ClientConstructor {
    scrape(
      options: ScrapeOptions,
      callback: (error: Error | null, results: ScrapeResponse) => void,
    ): Client;
  }

  const Client: ClientConstructor;

  export default Client;
}