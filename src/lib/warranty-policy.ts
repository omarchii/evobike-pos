import React from "react";
import crypto from "crypto";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import {
  assertBranchConfiguredForPDF,
} from "@/lib/branch";
import { resolveSealBuffer } from "@/lib/pdf/components/document-footer";
import { PolizaPDF } from "@/lib/pdf/templates/poliza-pdf";
import type { PolizaPDFData } from "@/lib/pdf/templates/poliza-pdf";
import * as blob from "@/lib/storage/blob";

const PDF_ENGINE_VERSION = "@react-pdf/renderer@4.4.1";

export async function generateWarrantyPDF(
  policyId: string,
): Promise<{ buffer: Buffer; sha256: string }> {
  const policy = await prisma.warrantyPolicy.findUniqueOrThrow({
    where: { id: policyId },
    include: {
      sale: {
        include: {
          user: { select: { name: true } },
        },
      },
      saleItem: {
        include: {
          productVariant: {
            include: { modelo: true, color: true, voltaje: true },
          },
        },
      },
      customerBike: {
        include: {
          customer: { select: { name: true, phone: true, email: true } },
          branch: true,
          productVariant: {
            include: { modelo: true, color: true, voltaje: true },
          },
        },
      },
    },
  });

  const bike = policy.customerBike;
  const branch = await assertBranchConfiguredForPDF(bike.branchId, "poliza");

  const assignments = await prisma.batteryAssignment.findMany({
    where: { customerBikeId: bike.id, isCurrent: true },
    include: { battery: { include: { lot: true } } },
  });

  const baterias = assignments.map((a) => ({
    serial: a.battery.serialNumber,
    lote: a.battery.lot.reference ?? a.battery.lot.supplier ?? "—",
    fechaRecepcion: a.battery.lot.receivedAt.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  }));

  const sealSrc = branch.sealImageUrl
    ? await resolveSealBuffer(branch.sealImageUrl)
    : null;

  const pv = bike.productVariant ?? policy.saleItem.productVariant;

  const polizaData: PolizaPDFData = {
    branch,
    folio: policy.sale.folio,
    fecha: policy.startedAt.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    cliente: {
      nombre: bike.customer?.name ?? "Cliente",
      telefono: bike.customer?.phone ?? null,
      email: bike.customer?.email ?? null,
    },
    vehiculo: {
      modelo: pv?.modelo?.nombre ?? bike.model ?? "—",
      color: pv?.color?.nombre ?? bike.color ?? "—",
      voltaje: pv?.voltaje?.label ?? bike.voltaje ?? "—",
      vin: bike.serialNumber,
    },
    baterias,
    terminos:
      typeof policy.termsSnapshot === "string"
        ? policy.termsSnapshot
        : (policy.termsSnapshot as { text?: string })?.text ?? "",
    sealImagePath: branch.sealImageUrl,
    elaboradoPor: policy.sale.user?.name ?? "",
  };

  const element = React.createElement(PolizaPDF, {
    data: polizaData,
    sealSrc,
  }) as unknown as React.ReactElement<DocumentProps>;

  const buffer = Buffer.from(await renderToBuffer(element));
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  return { buffer, sha256 };
}

export async function generateAndUploadWarrantyPDF(
  policyId: string,
): Promise<void> {
  const { buffer, sha256 } = await generateWarrantyPDF(policyId);

  const key = `warranty-policies/${policyId}.pdf`;
  await blob.put(key, buffer, "application/pdf");

  const policy = await prisma.warrantyPolicy.findUniqueOrThrow({
    where: { id: policyId },
  });

  const now = new Date();
  await prisma.warrantyPolicy.update({
    where: { id: policyId },
    data: {
      docUrl: key,
      docSha256: sha256,
      pdfEngineVersion: PDF_ENGINE_VERSION,
      docPrintedAt: policy.docPrintedAt ?? now,
      lastPrintedAt: now,
      printCount: { increment: 1 },
    },
  });
}
