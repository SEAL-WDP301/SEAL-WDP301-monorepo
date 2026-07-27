import * as winston from "winston";
import { utilities as nestWinstonModuleUtilities } from "nest-winston";
import { ConfigService } from "@nestjs/config";

// ignore nest bootstrap log
const ignoreNestBootstrap = winston.format((info) => {
  const ignoredContexts = ["InstanceLoader", "RouterExplorer"];
  //'RoutesResolver'
  if (ignoredContexts.includes(info.context as string)) {
    return false; // Hủy dòng log này
  }
  return info; // Giữ lại dòng log
});

export const createWinstonConfig = (configService: ConfigService) => {
  const isProduction =
    configService.get<string>("app.nodeEnv") === "production";

  return {
    level: isProduction ? "warn" : "info",

    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          ignoreNestBootstrap(), // Kích hoạt bộ lọc
          winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
          winston.format.ms(),
          nestWinstonModuleUtilities.format.nestLike("SEAL", {
            colors: true,
            prettyPrint: true,
            processId: true,
            appName: true,
          }),
        ),
      }),
    ],
  };
};
