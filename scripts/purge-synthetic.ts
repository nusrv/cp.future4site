import { prisma } from "../src/server/db.js";

async function main() {
  await prisma.publishingRecord.deleteMany({ where: { contentItem: { request: { synthetic: true } } } });
  await prisma.contentItem.deleteMany({ where: { request: { synthetic: true } } });
  await prisma.contentRequest.deleteMany({ where: { synthetic: true } });
  await prisma.deal.deleteMany({ where: { synthetic: true } });
  await prisma.task.deleteMany({ where: { synthetic: true } });
  await prisma.lead.deleteMany({ where: { synthetic: true } });
  await prisma.inquiry.deleteMany({ where: { synthetic: true } });
  await prisma.supplierProfile.deleteMany({ where: { synthetic: true } });
  await prisma.customerProfile.deleteMany({ where: { synthetic: true } });
  await prisma.contact.deleteMany({ where: { synthetic: true } });
  await prisma.organization.deleteMany({ where: { synthetic: true } });
  await prisma.knowledgeIndex.deleteMany({ where: { synthetic: true } });
  console.log("Synthetic records purged.");
}

main().finally(async () => prisma.$disconnect());

