import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { slugify } from "@/lib/utils";

function getUploadDirectory() {
  const configured = process.env.UPLOAD_DIR;

  if (configured) {
    return path.isAbsolute(configured)
      ? configured
      : path.join(/* turbopackIgnore: true */ process.cwd(), configured.replace(/^\.\//, ""));
  }

  return path.join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads", "events");
}

export async function saveEventImage(file: FormDataEntryValue | null) {
  if (!file || typeof file === "string") {
    return null;
  }

  if (file.size === 0) {
    return null;
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const extension = path.extname(file.name) || ".bin";
  const baseName = slugify(path.basename(file.name, extension)) || "event";
  const filename = `${baseName}-${randomUUID()}${extension}`;
  const directory = getUploadDirectory();

  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, filename), bytes);

  return `/uploads/events/${filename}`;
}
