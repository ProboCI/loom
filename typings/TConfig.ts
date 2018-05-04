type TConfig = {
  tokens: string[];
  server: {
    host: string;
    port: number;
  };
  db: {
    host?: string;
    port?: number;
    db: string;
    metaTable?: string;
    logsTable?: string;
    dataDir?: string;
    tailTimeout?: number | string;
    compress?: boolean;
  };
};
