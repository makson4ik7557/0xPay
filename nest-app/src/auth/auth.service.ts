import { ConflictException, UnauthorizedException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/client';
import * as argon2 from 'argon2';
import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService{
  constructor (
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService
  ) {}

  async register(dto:RegisterDto){
    const hashedPassword = await argon2.hash(dto.password);
    try{
      const user = await this.prisma.user.create({data:{passwordHash:hashedPassword,email:dto.email}});
      return {
        email: user.email,
        id: user.id,
        createdAt: user.createdAt
      }
    } catch (err){
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Email already taken');
        }
      throw err;
    }
  }

  async login(dto:LoginDto){
    const user = await this.prisma.user.findUnique({where: {email: dto.email}});
    if(!user) throw new UnauthorizedException('Invalid credentials');
    const isMatch = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!isMatch) throw new UnauthorizedException('Invalid credentials');
    const token = this.jwt.sign({sub: user.id});
    return {token}
  }

  async getMe(userId:number) {
    return this.prisma.user.findUnique({
      where: {id: userId},
      select: {id:true, email:true, createdAt:true}
    });
  }
}