import { createCrossOriginIsolationHeaders } from '@main/cross-origin-isolation'

describe('cross-origin isolation headers', () => {
  it('sets COOP and COEP for renderer documents', () => {
    expect(createCrossOriginIsolationHeaders()).toEqual({
      'Cross-Origin-Opener-Policy': ['same-origin'],
      'Cross-Origin-Embedder-Policy': ['require-corp']
    })
  })
})
