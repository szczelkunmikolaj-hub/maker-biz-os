export interface BuildPlate {
  id: string;
  name: string;
  printIds: string[]; // references to Print ids within the project
}

export interface ImportedFileEntry {
  id: string;
  filename: string;
  projectName: string;
  printTimeHours: number;
  filamentGrams: number;
  filamentType: string;
  filamentColor: string;
  detectedAt: string;
  source: 'upload' | 'json' | 'local';
  fileType: 'stl' | '3mf' | 'gcode' | 'json';
  stlGeometry?: any; // THREE.BufferGeometry stored in memory only
  stlInfo?: {
    width: number;
    height: number;
    depth: number;
    volume: number;
    triangles: number;
  };
  buildPlateId?: string;
  quantity: number;
}

export interface BuildPlateWithFiles {
  plate: BuildPlate;
  files: ImportedFileEntry[];
  totalTime: number;
  totalGrams: number;
}
