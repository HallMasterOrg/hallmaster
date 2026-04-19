import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiFailedDependencyResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { AuthGuard } from '../auth/guards/jwt.guard.js';

import { BotService } from './bot.service.js';
import { CreateBotZodDto } from './dto/create-bot.dto.js';
import { GetBotZodDto } from './dto/get-bot.dto.js';
import { GetRecommendedShardsZodDto } from './dto/get-recommended-shards.dto.js';
import { UpdateBotZodDto } from './dto/update-bot.dto.js';

@ApiTags('Bot')
@Controller('bot')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard)
@ApiUnauthorizedResponse({
  description: 'This route is protected by an Authorization header that is either not provided or invalid.',
})
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Get('recommended-shards')
  @ApiOkResponse({
    description: 'The recommended number of shards from the Discord API.',
    type: GetRecommendedShardsZodDto,
  })
  @ApiNotFoundResponse({
    description: 'No bot created beforehand.',
  })
  @ApiUnauthorizedResponse({
    description: 'The Discord bot token stored in database is invalid.',
  })
  @ApiFailedDependencyResponse({
    description: 'Got an invalid response from the Discord API.',
  })
  getRecommendedShards() {
    return this.botService.getRecommendedShards();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'The bot informations have been retrieve correctly and it has been created in database successfully.',
    type: GetBotZodDto,
  })
  @ApiConflictResponse({
    description: 'The bot is already created.',
  })
  create(@Body() createBotDto: CreateBotZodDto) {
    return this.botService.create(createBotDto);
  }

  @Get()
  @ApiOkResponse({
    description: 'The registered bot.',
    type: GetBotZodDto,
  })
  @ApiNotFoundResponse({
    description: 'No bot created beforehand.',
  })
  findOne() {
    return this.botService.findOne();
  }

  @Patch()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiAcceptedResponse({
    description: 'Updated bot information.',
    type: GetBotZodDto,
  })
  @ApiNotFoundResponse({
    description: 'No bot to update.',
  })
  update(@Body() updateBotDto: UpdateBotZodDto) {
    return this.botService.update(updateBotDto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'The bot is deleted.',
  })
  @ApiNotFoundResponse({
    description: 'No bot to update.',
  })
  async remove() {
    await this.botService.remove();
  }
}
