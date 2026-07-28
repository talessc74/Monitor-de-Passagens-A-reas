/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Fonte da verdade movida para packages/types (compartilhada com o backend).
// Este arquivo existe só para não quebrar os imports do frontend atual
// (`./types`) até a migração para apps/web na Fase 2.
export * from '../packages/types/src/index';
