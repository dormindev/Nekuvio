// THIS FILE IS GENERATED.
// DO NOT EDIT MANUALLY.


export type NekobtMetadata = {
  subLevel?: number | null;
  mtl?: boolean | null;
  otl?: boolean | null;
  hardsubs?: boolean | null;
  videoType?: number | null;
  videoCodec?: number | null;
  batch?: boolean | null;
};

const INVISIBLE_MARKERS = {
  start: "\u2060",
  end: "\u034f",
  base4: [
    "\u2061",
    "\u2062",
    "\u2063",
    "\u2064",
  ],
} as const;

const NEKOBT_PROTOCOL = {
  version: 0,
  magic: 78,
  magicWidth: 4,
  versionWidth: 2,
  fieldIdWidth: 2,
} as const;

const NEKOBT_FIELDS = {
  subLevel: { id: 1, width: 2 },
  mtl: { id: 2, width: 0 },
  otl: { id: 3, width: 0 },
  hardsubs: { id: 4, width: 0 },
  videoType: { id: 5, width: 3 },
  videoCodec: { id: 6, width: 2 },
  batch: { id: 7, width: 0 },
} as const;

type NekobtField =
  (typeof NEKOBT_FIELDS)[keyof typeof NEKOBT_FIELDS];


function encodeBase4(
  value: number,
  width: number,
): string {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= 4 ** width
  ) {
    return "";
  }

  let result = "";

  for (
    let shift = width - 1;
    shift >= 0;
    shift--
  ) {
    const digit =
      Math.floor(value / 4 ** shift) % 4;

    result += INVISIBLE_MARKERS.base4[digit];
  }

  return result;
}


function encodeBadge(payload: string): string {
  if (!payload) {
    return "";
  }

  const magic = encodeBase4(
    NEKOBT_PROTOCOL.magic,
    NEKOBT_PROTOCOL.magicWidth,
  );

  const version = encodeBase4(
    NEKOBT_PROTOCOL.version,
    NEKOBT_PROTOCOL.versionWidth,
  );

  if (!magic || !version) {
    return "";
  }

  return (
    INVISIBLE_MARKERS.start +
    magic +
    version +
    payload +
    INVISIBLE_MARKERS.end
  );
}


function encodeBooleanField(
  fieldId: number,
  value: unknown,
): string {
  if (value !== true) {
    return "";
  }

  const payload = encodeBase4(
    fieldId,
    NEKOBT_PROTOCOL.fieldIdWidth,
  );

  return encodeBadge(payload);
}


function encodeNumericField(
  fieldId: number,
  value: unknown,
  width: number,
): string {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return "";
  }

  const encodedFieldId = encodeBase4(
    fieldId,
    NEKOBT_PROTOCOL.fieldIdWidth,
  );

  const encodedValue = encodeBase4(
    value,
    width,
  );

  if (!encodedFieldId || !encodedValue) {
    return "";
  }

  return encodeBadge(
    encodedFieldId + encodedValue,
  );
}


function encodeField(
  field: NekobtField,
  value: unknown,
): string {
  if (field.width === 0) {
    return encodeBooleanField(
      field.id,
      value,
    );
  }

  return encodeNumericField(
    field.id,
    value,
    field.width,
  );
}


export function encodeNekobtMetadata(
  metadata: NekobtMetadata | null | undefined,
): string {
  if (!metadata) {
    return "";
  }

  let result = "";

  for (const [name, value] of Object.entries(metadata)) {
    const field =
      NEKOBT_FIELDS[
        name as keyof typeof NEKOBT_FIELDS
      ];

    if (!field) {
      continue;
    }

    // -1 means "no sub-level", so no badge is emitted.
    if (
      name === "subLevel" &&
      value === -1
    ) {
      continue;
    }

    result += encodeField(field, value);
  }

  return result;
}
