export interface ParamRange {
  min: number | null;
  max: number | null;
  unit: string;
  label: string;
}

export interface LgParamRanges {
  [key: string]: ParamRange;
}

const COOLING_RANGES: Record<string, Record<string, ParamRange>> = {
  multi_v_ii: {
    pressaoDescarga: { min: 2000, max: 3000, unit: "kPa", label: "Pressão de descarga" },
    pressaoSucao: { min: 600, max: 1000, unit: "kPa", label: "Pressão de sucção" },
    eevUnidadeInterna: { min: 200, max: 600, unit: "Pulso", label: "EEV unidade interna" },
    serpentinaSaida: { min: 6, max: 15, unit: "°C", label: "Serpentina interna (saída)" },
    descargaCompressor: { min: 60, max: 100, unit: "°C", label: "Descarga do compressor" },
    superaquecimentoSucao: { min: 0.5, max: null, unit: "°C", label: "Superaquecimento da sucção (SH)" },
  },
  multi_v_iii: {
    pressaoDescarga: { min: 2000, max: 3600, unit: "kPa", label: "Pressão de descarga" },
    pressaoSucao: { min: 600, max: 1000, unit: "kPa", label: "Pressão de sucção" },
    eevUnidadeInterna: { min: 200, max: 600, unit: "Pulso", label: "EEV unidade interna" },
    serpentinaSaida: { min: 6, max: 15, unit: "°C", label: "Serpentina interna (saída)" },
    descargaCompressor: { min: 60, max: 105, unit: "°C", label: "Descarga do compressor" },
    superaquecimentoSucao: { min: 0.5, max: null, unit: "°C", label: "Superaquecimento da sucção (SH)" },
  },
  multi_v_iv: {
    pressaoDescarga: { min: 2000, max: 3600, unit: "kPa", label: "Pressão de descarga" },
    pressaoSucao: { min: 500, max: 1000, unit: "kPa", label: "Pressão de sucção" },
    eevUnidadeInterna: { min: 200, max: 600, unit: "Pulso", label: "EEV unidade interna" },
    serpentinaEntrada: { min: 0, max: 10, unit: "°C", label: "Serpentina interna (entrada)" },
    serpentinaSaida: { min: 6, max: 15, unit: "°C", label: "Serpentina interna (saída)" },
    descargaCompressor: { min: 60, max: 100, unit: "°C", label: "Descarga do compressor" },
    superaquecimentoSucao: { min: 0.5, max: null, unit: "°C", label: "Superaquecimento da sucção (SH)" },
  },
  multi_v_5: {
    pressaoDescarga: { min: 2000, max: 3600, unit: "kPa", label: "Pressão de descarga" },
    pressaoSucao: { min: 500, max: 1000, unit: "kPa", label: "Pressão de sucção" },
    eevUnidadeInterna: { min: 200, max: 600, unit: "Pulso", label: "EEV unidade interna" },
    serpentinaEntrada: { min: 0, max: 10, unit: "°C", label: "Serpentina interna (entrada)" },
    serpentinaSaida: { min: 6, max: 15, unit: "°C", label: "Serpentina interna (saída)" },
    descargaCompressor: { min: 60, max: 100, unit: "°C", label: "Descarga do compressor" },
    superaquecimentoSucao: { min: 0.5, max: null, unit: "°C", label: "Superaquecimento da sucção (SH)" },
  },
};

const HEATING_RANGES: Record<string, Record<string, ParamRange>> = {
  multi_v_ii: {
    pressaoDescarga: { min: 2500, max: 3200, unit: "kPa", label: "Pressão de descarga" },
    pressaoSucao: { min: 200, max: 1200, unit: "kPa", label: "Pressão de sucção" },
    eevUnidadeInterna: { min: 200, max: 1350, unit: "Pulso", label: "EEV unidade interna" },
    eevUnidadeExterna: { min: 200, max: 800, unit: "Pulso", label: "EEV unidade externa" },
    superaquecimentoDescarga: { min: 17, max: null, unit: "°C", label: "Superaquecimento da descarga" },
    descargaCompressor: { min: 60, max: 100, unit: "°C", label: "Descarga do compressor" },
    superaquecimentoSucao: { min: 0.5, max: null, unit: "°C", label: "Superaquecimento da sucção (SH)" },
  },
  multi_v_iii: {
    pressaoDescarga: { min: 2500, max: 3200, unit: "kPa", label: "Pressão de descarga" },
    pressaoSucao: { min: 200, max: 1200, unit: "kPa", label: "Pressão de sucção" },
    eevUnidadeInterna: { min: 200, max: 1350, unit: "Pulso", label: "EEV unidade interna" },
    eevUnidadeExterna: { min: 200, max: 800, unit: "Pulso", label: "EEV unidade externa" },
    superaquecimentoDescarga: { min: 15, max: null, unit: "°C", label: "Superaquecimento da descarga" },
    descargaCompressor: { min: 60, max: 105, unit: "°C", label: "Descarga do compressor" },
    superaquecimentoSucao: { min: 0.5, max: null, unit: "°C", label: "Superaquecimento da sucção (SH)" },
  },
  multi_v_iv: {
    pressaoDescarga: { min: 2300, max: 3300, unit: "kPa", label: "Pressão de descarga" },
    pressaoSucao: { min: 200, max: 1200, unit: "kPa", label: "Pressão de sucção" },
    eevUnidadeInterna: { min: 150, max: 1350, unit: "Pulso", label: "EEV unidade interna" },
    eevUnidadeExterna: { min: 200, max: 800, unit: "Pulso", label: "EEV unidade externa" },
    superaquecimentoDescarga: { min: 15, max: null, unit: "°C", label: "Superaquecimento da descarga" },
    descargaCompressor: { min: 60, max: 100, unit: "°C", label: "Descarga do compressor" },
    superaquecimentoSucao: { min: 0.5, max: null, unit: "°C", label: "Superaquecimento da sucção (SH)" },
  },
  multi_v_5: {
    pressaoDescarga: { min: 2300, max: 3300, unit: "kPa", label: "Pressão de descarga" },
    pressaoSucao: { min: 200, max: 1200, unit: "kPa", label: "Pressão de sucção" },
    eevUnidadeInterna: { min: 150, max: 1350, unit: "Pulso", label: "EEV unidade interna" },
    eevUnidadeExterna: { min: 200, max: 800, unit: "Pulso", label: "EEV unidade externa" },
    superaquecimentoDescarga: { min: 15, max: null, unit: "°C", label: "Superaquecimento da descarga" },
    descargaCompressor: { min: 60, max: 100, unit: "°C", label: "Descarga do compressor" },
    superaquecimentoSucao: { min: 0.5, max: null, unit: "°C", label: "Superaquecimento da sucção (SH)" },
  },
};

export function getLgParamRanges(
  vrfType: string,
  mode: "cooling" | "heating"
): LgParamRanges {
  const ranges = mode === "cooling" ? COOLING_RANGES : HEATING_RANGES;
  return ranges[vrfType] ?? ranges["multi_v_5"];
}
