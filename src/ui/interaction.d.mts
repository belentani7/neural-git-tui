export interface PositionedNeuron {
  id: string;
  position: { x: number; y: number };
}
export type Direction = 'up' | 'down' | 'left' | 'right';
export declare function editSearchQuery(query: string, keyName: string, character: string | undefined, limit?: number): string;
export declare function nextNeuronId(neurons: ReadonlyMap<string, PositionedNeuron>, currentId: string | null, direction: Direction): string | null;
