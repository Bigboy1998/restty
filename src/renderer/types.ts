/// <reference types="@webgpu/types" />
import type { Color } from "./shapes";

export type WebGPUState = {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
  srgbSwapchain: boolean;
  rectPipeline: GPURenderPipeline;
  glyphPipeline: GPURenderPipeline;
  glyphPipelineNearest: GPURenderPipeline;
  rectBindGroup: GPUBindGroup;
  uniformBuffer: GPUBuffer;
  vertexBuffer: GPUBuffer;
  rectInstanceBuffer: GPUBuffer;
  rectCapacity: number;
  glyphInstanceBuffer: GPUBuffer;
  glyphCapacity: number;
  glyphAtlases: Map<number, AtlasState>;
};

export type AtlasState = {
  texture: GPUTexture;
  sampler?: GPUSampler;
  samplerNearest?: GPUSampler;
  samplerLinear?: GPUSampler;
  bindGroup: GPUBindGroup;
  bindGroupNearest?: GPUBindGroup;
  bindGroupLinear?: GPUBindGroup;
  width: number;
  height: number;
  inset: number;
  colorGlyphs?: Set<number>;
  constrainedGlyphWidths?: Map<number, number>;
  nearest?: boolean;
};

export type WebGLState = {
  gl: WebGL2RenderingContext;
  rectProgram: WebGLProgram;
  glyphProgram: WebGLProgram;
  rectResolutionLoc: WebGLUniformLocation;
  rectBlendLoc: WebGLUniformLocation;
  glyphResolutionLoc: WebGLUniformLocation;
  glyphBlendLoc: WebGLUniformLocation;
  glyphAtlasLoc: WebGLUniformLocation;
  quadBuffer: WebGLBuffer;
  rectVao: WebGLVertexArrayObject;
  glyphVao: WebGLVertexArrayObject;
  rectInstanceBuffer: WebGLBuffer;
  glyphInstanceBuffer: WebGLBuffer;
  rectCapacity: number;
  glyphCapacity: number;
  glyphAtlases: Map<number, WebGLAtlasState>;
};

export type WebGLAtlasState = {
  texture: WebGLTexture;
  width: number;
  height: number;
  inset: number;
  colorGlyphs?: Set<number>;
  constrainedGlyphWidths?: Map<number, number>;
  nearest?: boolean;
};

export type RendererState = WebGPUState | WebGLState | null;

export type RendererConfig = {
  defaultBg: Color;
  defaultFg: Color;
  selectionColor: Color;
  cursorFallback: Color;
};

export type ResizeState = {
  active: boolean;
  lastAt: number;
  cols: number;
  rows: number;
  dpr: number;
};

export type ScrollbarState = {
  lastInputAt: number;
  lastTotal: number;
  lastOffset: number;
  lastLen: number;
};
