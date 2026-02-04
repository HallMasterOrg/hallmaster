import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { BotService } from './bot.service.js';
import {
  ApiAcceptedResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CreateBotDto,
  UpdateBotDto,
  GetBotDto,
} from '../../../shared/src/index.js';

@ApiTags('Bot')
@Controller('bot')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description:
      'The bot informations have been retrieve correctly and it has been created in database successfully.',
    type: GetBotDto,
  })
  @ApiConflictResponse({
    description: 'The bot is already created.',
  })
  create(@Body() createBotDto: CreateBotDto) {
    return this.botService.create(createBotDto);
  }

  @Get()
  @ApiOkResponse({
    description: 'The registered bot.',
    type: GetBotDto,
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
    type: GetBotDto,
  })
  @ApiNotFoundResponse({
    description: 'No bot to update.',
  })
  update(@Body() updateBotDto: UpdateBotDto) {
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
