import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  password: 'hashed-password',
  name: 'Test User',
  isSuperAdmin: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTenant = {
  id: 'tenant-1',
  name: 'Test Corp',
  slug: 'test-corp',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
  tenant: { findUnique: jest.fn(), create: jest.fn(), findUniqueOrThrow: jest.fn() },
  userTenant: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn() },
  $transaction: jest.fn(),
};

const mockJwt = { sign: jest.fn().mockReturnValue('mock.jwt.token') };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('throws ConflictException when email already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({ email: 'test@example.com', password: 'Pass@1234', tenantName: 'Corp' }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates user, tenant, and returns access token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrisma) => Promise<[typeof mockUser, typeof mockTenant]>) =>
          cb(mockPrisma),
      );
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.tenant.create.mockResolvedValue(mockTenant);
      mockPrisma.userTenant.create.mockResolvedValue({});

      const result = await service.register({
        email: 'new@example.com',
        password: 'Pass@1234',
        tenantName: 'Test Corp',
      });

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.user.email).toBe(mockUser.email);
      expect(result.tenant.slug).toBe(mockTenant.slug);
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'new@example.com' }) }),
      );
    });

    it('generates a unique slug when the base slug is already taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.findUnique
        .mockResolvedValueOnce(mockTenant) // 'test-corp' is taken
        .mockResolvedValueOnce(null); // 'test-corp-1' is free
      mockPrisma.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrisma) => Promise<[typeof mockUser, typeof mockTenant]>) =>
          cb(mockPrisma),
      );
      const sluggedTenant = { ...mockTenant, slug: 'test-corp-1' };
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.tenant.create.mockResolvedValue(sluggedTenant);
      mockPrisma.userTenant.create.mockResolvedValue({});

      const result = await service.register({
        email: 'new@example.com',
        password: 'Pass@1234',
        tenantName: 'Test Corp',
      });

      expect(result.tenant.slug).toBe('test-corp-1');
    });
  });

  describe('login', () => {
    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ email: 'ghost@example.com', password: 'pass' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when password is wrong', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare' as never).mockResolvedValue(false as never);

      await expect(
        service.login({ email: mockUser.email, password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws NotFoundException when no active tenant exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare' as never).mockResolvedValue(true as never);
      mockPrisma.userTenant.findFirst.mockResolvedValue(null);

      await expect(service.login({ email: mockUser.email, password: 'Pass@1234' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns access token and user data on valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare' as never).mockResolvedValue(true as never);
      mockPrisma.userTenant.findFirst.mockResolvedValue({
        tenantId: mockTenant.id,
        role: Role.ADMIN,
        tenant: mockTenant,
      });
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue(mockTenant);

      const result = await service.login({ email: mockUser.email, password: 'Pass@1234' });

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.user.id).toBe(mockUser.id);
      expect(result.tenant.id).toBe(mockTenant.id);
    });

    it('uses specified tenantId when provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare' as never).mockResolvedValue(true as never);
      mockPrisma.userTenant.findUnique.mockResolvedValue({
        tenantId: mockTenant.id,
        role: Role.MEMBER,
        tenant: mockTenant,
      });
      mockPrisma.tenant.findUniqueOrThrow.mockResolvedValue(mockTenant);

      const result = await service.login({
        email: mockUser.email,
        password: 'Pass@1234',
        tenantId: mockTenant.id,
      });

      expect(result.accessToken).toBe('mock.jwt.token');
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: mockTenant.id, role: Role.MEMBER }),
      );
    });

    it('throws NotFoundException when specified tenantId membership is not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare' as never).mockResolvedValue(true as never);
      mockPrisma.userTenant.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: mockUser.email, password: 'Pass@1234', tenantId: 'unknown-id' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when specified tenant is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      jest.spyOn(bcrypt, 'compare' as never).mockResolvedValue(true as never);
      mockPrisma.userTenant.findUnique.mockResolvedValue({
        tenantId: mockTenant.id,
        role: Role.MEMBER,
        tenant: { ...mockTenant, isActive: false },
      });

      await expect(
        service.login({ email: mockUser.email, password: 'Pass@1234', tenantId: mockTenant.id }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
