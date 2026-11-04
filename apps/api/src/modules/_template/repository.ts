import type { ExampleItem, CreateExampleDto } from './types.js';

export class ExampleRepository {
  private items: ExampleItem[] = [];

  async findById(id: string): Promise<ExampleItem | null> {
    return this.items.find((item) => item.id === id) ?? null;
  }

  async create(data: CreateExampleDto): Promise<ExampleItem> {
    const item: ExampleItem = {
      id: `item-${Date.now()}`,
      name: data.name,
      createdAt: new Date(),
    };
    this.items.push(item);
    return item;
  }
}

