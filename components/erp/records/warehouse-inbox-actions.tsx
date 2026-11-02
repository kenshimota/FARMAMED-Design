"use client";

import {
  RecordActionButton,
  RecordActionLink,
  RecordActions,
} from "@/components/erp/records/record-actions";
import { lotProductName } from "@/components/erp/records/lot-shared";
import type { WarehouseInboxLot } from "@/components/erp/records/warehouse-inbox-api";

type WarehouseInboxActionsProps = {
  lot: WarehouseInboxLot;
  canWrite: boolean;
  currentUserId: string | null;
  starting: boolean;
  onStart: (lot: WarehouseInboxLot) => void;
  onAssign: (lot: WarehouseInboxLot) => void;
};

function startedById(lot: WarehouseInboxLot) {
  return lot.started_by?.id ?? lot.location_started_by?.id ?? null;
}

export function WarehouseInboxActions({
  lot,
  canWrite,
  currentUserId,
  starting,
  onStart,
  onAssign,
}: WarehouseInboxActionsProps) {
  const productName = lotProductName(lot.product, lot.product_id);
  const actorId = startedById(lot);
  const isMine =
    currentUserId !== null &&
    actorId !== null &&
    String(actorId) === String(currentUserId);
  const canAssign =
    canWrite &&
    lot.location_status === "in_progress" &&
    (isMine || actorId === null);

  return (
    <RecordActions>
      <RecordActionLink
        ariaLabel={`Ver el detalle del lote ${lot.number} de ${productName}`}
        href={`/app/lotes/${lot.id}`}
        icon="eye"
      >
        Ver lote
      </RecordActionLink>
      {canWrite && lot.location_status === "pending" && (
        <RecordActionButton
          aria-busy={starting || undefined}
          aria-label={`Empezar a ubicar el lote ${lot.number} de ${productName}`}
          disabled={starting}
          icon="warehouse"
          onClick={() => onStart(lot)}
        >
          {starting ? "Iniciando…" : "Empezar a ubicar"}
        </RecordActionButton>
      )}
      {canAssign && (
        <RecordActionButton
          aria-label={`Asignar ubicación al lote ${lot.number} de ${productName}`}
          icon="map-pin"
          onClick={() => onAssign(lot)}
        >
          Asignar ubicación
        </RecordActionButton>
      )}
    </RecordActions>
  );
}
