import { field, logger } from "@coder/logger"
import * as fs from "fs"
import * as path from "path"
import * as util from "util"
import { Args } from "./cli"
import { HttpServer } from "./http"

/* eslint-disable @typescript-eslint/no-var-requires */

export type Activate = (httpServer: HttpServer, args: Args) => void

export interface Plugin {
  activate: Activate
}

const originalLoad = require("module")._load
// eslint-disable-next-line @typescript-eslint/no-explicit-any
require("module")._load = function (request: string, parent: object, isMain: boolean): any {
  return originalLoad.apply(this, [request.replace(/^code-server/, path.resolve(__dirname, "../..")), parent, isMain])
}

const loadPlugin = async (pluginDir: string, httpServer: HttpServer, args: Args): Promise<void> => {
  try {
    const plugin: Plugin = require(pluginDir)
    plugin.activate(httpServer, args)
    logger.debug("Loaded plugin", field("name", path.basename(pluginDir)))
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") {
      logger.warn(error.message)
    } else {
      logger.debug(error.message)
    }
  }
}

const _loadPlugins = async (httpServer: HttpServer, args: Args): Promise<void> => {
  const pluginDir = path.resolve(__dirname, "../../plugins")
  const files = await util.promisify(fs.readdir)(pluginDir, {
    withFileTypes: true,
  })
  await Promise.all(
    files.map((file) => {
      if (!file.isDirectory()) {
        return Promise.resolve()
      }

      return loadPlugin(path.join(pluginDir, file.name), httpServer, args)
    }),
  )
}

export const loadPlugins = async (httpServer: HttpServer, args: Args): Promise<void> => {
  try {
    await _loadPlugins(httpServer, args)
  } catch (error) {
    if (error.code !== "ENOENT") {
      logger.warn(error.message)
    }
  }
}
