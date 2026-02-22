import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { UserTokenDto } from './entities/user-token.entity.js';

@Controller('auth')
@ApiTags('Authentication')
@ApiInternalServerErrorResponse({
  description: 'This service is temporary unavailable.',
})
@ApiBadRequestResponse({
  description: 'The body of the request is invalid.',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    type: UserTokenDto,
    description: 'The Bearer token (JWT) for the new user.',
  })
  @ApiConflictResponse({
    description: 'A user is already registered.',
  })
  async register(@Body() body: RegisterDto): Promise<UserTokenDto> {
    return await this.authService.register(body);
  }

  @Post('login')
  @ApiOkResponse({
    type: UserTokenDto,
    description: 'The user token used to communicate with the API.',
  })
  @ApiUnauthorizedResponse({
    description: 'Either the email or the password is invalid.',
  })
  async login(@Body() body: LoginDto): Promise<UserTokenDto> {
    return await this.authService.login(body);
  }
}
