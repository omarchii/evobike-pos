import React from "react";
import { Document, Page } from "@react-pdf/renderer";
import { styles } from "@/lib/pdf/styles";
import { registerFonts } from "@/lib/pdf/fonts";

registerFonts();

type BaseDocumentProps = {
  title: string;
  children: React.ReactNode;
};

export function BaseDocument({ title, children }: BaseDocumentProps) {
  return (
    <Document title={title} author="EvoBike POS">
      <Page size="LETTER" style={styles.page}>
        {children}
      </Page>
    </Document>
  );
}
