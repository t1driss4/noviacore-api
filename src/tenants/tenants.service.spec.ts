import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from './tenants.service';

const mockTenant = {
  id: 'tenant-1',
  name: 'Acme Corp',
  slug: 'acme-corp',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const adminMembership = {
  id: 'ut-1',
  userId: 'user-1',
  tenantId: 'tenant-1',
  role: Role.ADMIN,
  tenant: mockTenant,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const memberMembership = { ...adminMembership, role: Role.MEMBER };

const mockPrisma = {
  tenant: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  userTenant: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  user: { findUnique: jest.fn() },
};

describe('TenantsService', () => {
  let service: TenantsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates a tenant and ADMIN membership for the user', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue(mockTenant);
      mockPrisma.userTenant.create.mockResolvedValue(adminMembership);

      const result = await service.create('user-1', { name: 'Acme Corp' });

      expect(mockPrisma.tenant.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Acme Corp' }) }),
      );
      expect(mockPrisma.userTenant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1', role: Role.ADMIN }),
        }),
      );
      expect(result.id).toBe(mockTenant.id);
    });
  });

  describe('findOne', () => {
    it('returns tenant with role when user is a member', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(adminMembership);

      const result = await service.findOne('tenant-1', 'user-1');

      expect(result.id).toBe('tenant-1');
      expect(result.role).toBe(Role.ADMIN);
    });

    it('throws NotFoundException when user is not a member', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(null);

      await expect(service.findOne('tenant-1', 'user-2')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates tenant when requester is ADMIN', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(adminMembership);
      mockPrisma.tenant.update.mockResolvedValue({ ...mockTenant, name: 'Renamed Corp' });

      const result = await service.update('tenant-1', 'user-1', { name: 'Renamed Corp' });

      expect(result.name).toBe('Renamed Corp');
    });

    it('throws ForbiddenException when requester is only a MEMBER', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(memberMembership);

      await expect(service.update('tenant-1', 'user-1', { name: 'Renamed' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('addMember', () => {
    it('adds a new member when requester is ADMIN', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(adminMembership);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'new@example.com' });
      mockPrisma.userTenant.create.mockResolvedValue({
        ...memberMembership,
        userId: 'user-2',
        user: { id: 'user-2', email: 'new@example.com', name: null },
      });

      const result = await service.addMember('tenant-1', 'user-1', {
        email: 'new@example.com',
        role: Role.MEMBER,
      });

      expect(result.userId).toBe('user-2');
    });

    it('throws NotFoundException when target user does not exist', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(adminMembership);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.addMember('tenant-1', 'user-1', { email: 'ghost@example.com' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when ADMIN tries to assign SUPER_ADMIN role', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(adminMembership);

      await expect(
        service.addMember('tenant-1', 'user-1', { email: 'new@example.com', role: Role.SUPER_ADMIN }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('removeMember', () => {
    it('removes a member when requester is ADMIN', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(adminMembership);
      mockPrisma.userTenant.delete.mockResolvedValue({});

      await service.removeMember('tenant-1', 'user-1', 'user-2');

      expect(mockPrisma.userTenant.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_tenantId: { userId: 'user-2', tenantId: 'tenant-1' } },
        }),
      );
    });
  });

  describe('findAllForUser', () => {
    it('returns tenants with role for the user', async () => {
      mockPrisma.userTenant.findMany.mockResolvedValue([adminMembership]);

      const result = await service.findAllForUser('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tenant-1');
      expect(result[0].role).toBe(Role.ADMIN);
    });

    it('returns empty array when user has no tenants', async () => {
      mockPrisma.userTenant.findMany.mockResolvedValue([]);

      const result = await service.findAllForUser('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('getMembers', () => {
    it('returns members when user belongs to the tenant', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(memberMembership);
      mockPrisma.userTenant.findMany.mockResolvedValue([adminMembership, memberMembership]);

      const result = await service.getMembers('tenant-1', 'user-1');

      expect(result).toHaveLength(2);
    });

    it('throws ForbiddenException when user is not a member', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(null);

      await expect(service.getMembers('tenant-1', 'user-2')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateMember', () => {
    it('updates member role when requester is ADMIN', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(adminMembership);
      mockPrisma.userTenant.update.mockResolvedValue({ ...memberMembership, role: Role.VIEWER });

      const result = await service.updateMember('tenant-1', 'user-1', 'user-2', {
        role: Role.VIEWER,
      });

      expect(result.role).toBe(Role.VIEWER);
      expect(mockPrisma.userTenant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_tenantId: { userId: 'user-2', tenantId: 'tenant-1' } },
          data: { role: Role.VIEWER },
        }),
      );
    });

    it('throws ForbiddenException when requester is only a MEMBER', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(memberMembership);

      await expect(
        service.updateMember('tenant-1', 'user-1', 'user-2', { role: Role.VIEWER }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when ADMIN tries to promote to SUPER_ADMIN', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(adminMembership);

      await expect(
        service.updateMember('tenant-1', 'user-1', 'user-2', { role: Role.SUPER_ADMIN }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('deletes the tenant when requester is ADMIN', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(adminMembership);
      mockPrisma.tenant.delete.mockResolvedValue(mockTenant);

      await service.remove('tenant-1', 'user-1');

      expect(mockPrisma.tenant.delete).toHaveBeenCalledWith({ where: { id: 'tenant-1' } });
    });

    it('throws ForbiddenException when requester is only a MEMBER', async () => {
      mockPrisma.userTenant.findUnique.mockResolvedValue(memberMembership);

      await expect(service.remove('tenant-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });
  });
});
