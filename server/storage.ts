import { type Waitlist, type InsertWaitlist, type Contact, type InsertContact } from "@shared/schema";

export interface IStorage {
  addToWaitlist(entry: InsertWaitlist): Promise<Waitlist>;
  submitContact(entry: InsertContact): Promise<Contact>;
}

export class MemStorage implements IStorage {
  private waitlist: Map<number, Waitlist>;
  private contact: Map<number, Contact>;
  private waitlistId: number;
  private contactId: number;

  constructor() {
    this.waitlist = new Map();
    this.contact = new Map();
    this.waitlistId = 1;
    this.contactId = 1;
  }

  async addToWaitlist(entry: InsertWaitlist): Promise<Waitlist> {
    const id = this.waitlistId++;
    const waitlistEntry: Waitlist = { ...entry, id };
    this.waitlist.set(id, waitlistEntry);
    return waitlistEntry;
  }

  async submitContact(entry: InsertContact): Promise<Contact> {
    const id = this.contactId++;
    const contactEntry: Contact = { ...entry, id };
    this.contact.set(id, contactEntry);
    return contactEntry;
  }
}

export const storage = new MemStorage();
