import Dexie, { type Table } from 'dexie';
import type { Paper, ApiConfig, Project } from './types';

export class PaperDB extends Dexie {
  papers!: Table<Paper, string>;
  apiConfigs!: Table<ApiConfig, string>;
  projects!: Table<Project, string>;

  constructor() {
    super('PaperAssistantDB');
    this.version(4).stores({
      papers: 'id, project_id, order, status, year, authors, field, created_at',
      apiConfigs: 'id, is_active, created_at',
      projects: 'id, created_at',
    });
  }
}

export const db = new PaperDB();
