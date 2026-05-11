import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

const mockUserProfile = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  isSuperAdmin: false,
  createdAt: new Date(),
};

const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('findMe', () => {
    it('returns user profile for valid user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUserProfile);

      const result = await service.findMe('user-1');

      expect(result.email).toBe(mockUserProfile.email);
      expect(result.id).toBe(mockUserProfile.id);
    });

    it('throws NotFoundException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findMe('nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateMe', () => {
    it('updates user name', async () => {
      const updated = { ...mockUserProfile, name: 'New Name', updatedAt: new Date() };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await service.updateMe('user-1', { name: 'New Name' });

      expect(result.name).toBe('New Name');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ name: 'New Name' }),
        }),
      );
    });

    it('hashes password when provided', async () => {
      const updated = { ...mockUserProfile, updatedAt: new Date() };
      mockPrisma.user.update.mockResolvedValue(updated);

      await service.updateMe('user-1', { password: 'NewPass@123' });

      const callData = mockPrisma.user.update.mock.calls[0][0].data;
      expect(callData.password).toBeDefined();
      expect(callData.password).not.toBe('NewPass@123');
    });

    it('does not include password in update when not provided', async () => {
      mockPrisma.user.update.mockResolvedValue(mockUserProfile);

      await service.updateMe('user-1', { name: 'Only Name' });

      const callData = mockPrisma.user.update.mock.calls[0][0].data;
      expect(callData.password).toBeUndefined();
    });
  });
});
